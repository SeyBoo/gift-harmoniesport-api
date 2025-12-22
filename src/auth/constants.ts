export const jwtConstants = {
  secret: process.env.JWT_SECRET || 'mysecret_metacard_checkSignature-Kr3@l!d',
  database: process.env.DATABASE_URL || 'default_database_url',
};
