export interface User {
  id: number;
  username: string;
  email: string;
  emailConfirmed: boolean;
  creationTimestamp?: Date;
}
