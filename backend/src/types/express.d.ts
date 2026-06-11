import { Request as ExpressRequest } from 'express';

// JWT payload type (returned by JwtStrategy.validate())
export interface JwtPayload {
  id: string;
  role: string;
}

// Custom authenticated request type for use in controllers
export type AuthenticatedRequest = ExpressRequest & {
  user: JwtPayload;
};
