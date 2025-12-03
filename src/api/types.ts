// types/api.ts
export type CreateUserData = {
  phone: string;
  passcode: string;
  email: string;
  roles?: string;
  status?: number;
  username?: string;
};