import { Module } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module.js';

/**
 * Composition root of the application. Every feature lives in
 * `src/modules/<context>` and follows the same
 * domain / application / infrastructure split.
 */
@Module({
  imports: [UsersModule],
})
export class AppModule {}
