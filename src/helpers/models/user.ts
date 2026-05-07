import { defineEntity, p } from '@mikro-orm/core';

export const UserSchema = defineEntity({
  name: 'User',
  properties: {
    id: p.bigint().primary(),
    username: p.string(),
    createdAt: p.datetime().onCreate(() => new Date()),
    updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
  },
});

export class User extends UserSchema.class {}

UserSchema.setClass(User);