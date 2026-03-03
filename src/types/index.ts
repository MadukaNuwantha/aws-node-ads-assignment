export interface Ad {
  adId: string;
  title: string;
  price: number;
  imageUrl?: string;
  createdAt: string;
}

export interface CreateAdInput {
  title: string;
  price: number;
  imageBase64?: string;
}

export interface ApiResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

export interface SignupInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupResponse {
  message: string;
  userId: string;
}

export interface LoginResponse {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}
