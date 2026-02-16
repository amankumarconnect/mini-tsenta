import { DateTime } from "luxon";
import hash from "@adonisjs/core/services/hash";
import { compose } from "@adonisjs/core/helpers";
import { BaseModel, column } from "@adonisjs/lucid/orm";
import { withAuthFinder } from "@adonisjs/auth/mixins/lucid";
import { DbAccessTokensProvider } from "@adonisjs/auth/access_tokens";

// Mixin to add authentication capabilities to the User model.
const AuthFinder = withAuthFinder(() => hash.use("scrypt"), {
  uids: ["email"], // Fields used to identify the user (e.g., login).
  passwordColumnName: "password",
});

// User model definition.
export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare fullName: string | null;

  @column()
  declare email: string;

  // Password field, hidden from JSON serialization.
  @column({ serializeAs: null })
  declare password: string;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null;

  // Configure access tokens provider for the User model.
  static accessTokens = DbAccessTokensProvider.forModel(User);
}
