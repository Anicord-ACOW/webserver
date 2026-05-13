import {type Server} from "node:http";
import type {Express} from "express";
import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import {createAuthToken} from "@/helpers/auth-tokens";

let server: Server;
let baseUrl: string;
let db: Awaited<ReturnType<typeof import("./helpers/mock-db").createMockDb>>;
let closeAppDatabase: () => Promise<void>;
let originalMysql: string | undefined;

describe("integration test", () => {
    beforeAll(async () => {
        // create db
        const {createMockDb} = await import("./helpers/mock-db");
        db = await createMockDb();
        originalMysql = process.env.MYSQL;
        process.env.MYSQL = db.clientUrl;
        console.log(`Using test database: ${db.clientUrl}`);

        const app = (await import("@/app")).default as Express;
        const {closeDatabase} = await import("@/helpers/db");
        closeAppDatabase = closeDatabase;

        // start server
        await new Promise<void>((resolve, reject) => {
            server = app.listen(0, () => {
                const address = server.address();
                if (address === null || typeof address === "string") {
                    reject(new Error("Failed to bind test server"));
                    return;
                }

                baseUrl = `http://127.0.0.1:${address.port}`;
                console.log(`Test server listening on ${baseUrl}`);
                resolve();
            });
        });
    }, 20000);

    afterAll(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
        await closeAppDatabase();
        await db.close();

        if (originalMysql === undefined) {
            delete process.env.MYSQL;
        } else {
            process.env.MYSQL = originalMysql;
        }
    }, 20000);

    it("returns the success flag and message", async () => {
        const response = await fetch(`${baseUrl}/`);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            success: true,
            message: "Did you read the README?",
        });
    });

    it("returns the correct user data", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/me`, {
            headers: {
                Authorization: token,
            },
        });
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
            user: {
                id: "1",
                username: "admin1",
                roles: [
                    "admin"
                ]
            }
        });

        const response2 = await fetch(`${baseUrl}/users/2`, {
            headers: {
                Authorization: token,
            },
        });
        const body2 = await response2.json();
        expect(response2.status).toBe(200);
        expect(body2).toMatchObject({
            success: true,
            user: {
                id: "2",
                username: "user2",
            }
        });
    });

    it("doesn't allow non admins to create seasons", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons`, {
            method: "PUT",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Test Season",
                signupsStart: "2026-05-13T00:00:00.000Z",
                signupsEnd: "2026-05-14T00:00:00.000Z",
            }),
        });
        expect(response.status).toBe(403);
    });

    it("doesn't allow inconsistent dates", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        // signups before now
        const response = await fetch(`${baseUrl}/seasons`, {
            method: "PUT",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Real Season",
                signupsStart: "2000-05-12T00:00:00.000Z",
                signupsEnd: "2099-05-14T00:00:00.000Z",
            }),
        });
        expect(response.status).toBe(400);

        // signup ends before starting
        const response2 = await fetch(`${baseUrl}/seasons`, {
            method: "PUT",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Real Season",
                signupsStart: "2099-05-15T00:00:00.000Z",
                signupsEnd: "2000-05-14T00:00:00.000Z",
            }),
        });
        expect(response2.status).toBe(400);
    });

    it("allows admins to create seasons", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons`, {
            method: "PUT",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Real Season",
                signupsStart: new Date(Date.now() + 60000).toISOString(),
                signupsEnd: new Date(Date.now() + 120000).toISOString(),
            })
        });
        expect(response.status).toBe(200);

        vi.useRealTimers();
    });

    it("doesn't allow season creation if the season is already in progress", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/seasons`, {
            method: "PUT",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Real Season",
                signupsStart: new Date(Date.now() + 60000).toISOString(),
                signupsEnd: new Date(Date.now() + 120000).toISOString(),
            })
        });
        const body = await response.json();
        expect(response.status).toBe(400);
        expect(body).toMatchObject({
            success: false,
            error: "Cannot create a new season while there is an active season",
        });
    });

    it("returns the correct season data", async () => {
        const response = await fetch(`${baseUrl}/seasons/1`);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
            season: {
                id: "1",
                name: "Real Season",
                completed: false,
            },
        });
    });

    it("returns the correct season data", async () => {
        const response = await fetch(`${baseUrl}/seasons/current`);
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
            season: {
                id: "1",
                name: "Real Season",
                completed: false,
            },
        });
    });

    it("allows users to update their signup form", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/me/signup-form`, {
            method: "PATCH",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                repServer: "Frieren",
                pcPower: "POTATO",
                preferredGameGenres: ["DATING", "FIGHTING"],
            }),
        });
        expect(response.status).toBe(200);
    });

    it("doesn't allow allow users to update others' signup form", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/1/signup-form`, {
            method: "PATCH",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                repServer: "Frieren",
                pcPower: "POTATO",
                preferredGameGenres: ["DATING", "FIGHTING"],
            }),
        });
        expect(response.status).toBe(403);
    });

    it("doesn't allow allow users to retrieve others' signup form", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/1/signup-form`, {
            method: "GET",
            headers: {
                Authorization: token,
            },
        });
        expect(response.status).toBe(403);
    });

    it("allows allow admins to update others' signup form", async () => {
        const token = createAuthToken({sub: "1"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/2/signup-form`, {
            method: "PATCH",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                repServer: "Shibouyugi",
                preferredGameGenres: ["CASUAL"],
            }),
        });
        expect(response.status).toBe(200);
    });

    it("returns the correct signup form data", async () => {
        const token = createAuthToken({sub: "2"}, {expiresIn: "1m"});
        const response = await fetch(`${baseUrl}/users/me/signup-form`, {
            method: "GET",
            headers: {
                Authorization: token,
            },
        });
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            success: true,
            form: {
                repServer: "Shibouyugi",
                pcPower: "POTATO",
                preferredGameGenres: ["CASUAL"],
            },
        });
    });
});
