type EnvShape = {
  DATABASE_URL: string;
  DIRECT_URL?: string;
  NODE_ENV?: string;
};

function required(name: keyof EnvShape, value: string | undefined) {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getEnv() {
  return {
    DATABASE_URL: required("DATABASE_URL", process.env.DATABASE_URL),
    DIRECT_URL: process.env.DIRECT_URL,
    NODE_ENV: process.env.NODE_ENV,
  };
}
