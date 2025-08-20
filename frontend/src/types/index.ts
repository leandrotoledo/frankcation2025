export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  profile_image?: string;
  role: string;
  total_points: number;
  challenges_completed: number;
  created_at: string;
}

export interface Challenge {
  id: number;
  title: string;
  description: string;
  points: number;
  challenge_type: 'exclusive' | 'open';
  assigned_to?: number;
  status: 'available' | 'in_progress' | 'completed';
  completed_by?: number;
  completed_post_id?: number;
  completed_at?: string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  completed_by_username?: string;
  assigned_to_username?: string;
  submissions?: ChallengeSubmission[];
}

export interface ChallengeSubmission {
  id: number;
  user_id: number;
  username: string;
  user_profile_image?: string;
  post_id: number;
  created_at: string;
}

export interface Post {
  id: number;
  user_id: number;
  challenge_id: number;
  media_url: string;
  media_type: 'photo' | 'video';
  caption?: string;
  created_at: string;
  revoked: boolean;
  username?: string;
  user_profile_image?: string;
  challenge_title?: string;
  challenge_points?: number;
  challenge_type?: 'exclusive' | 'open';
  challenge_status?: 'available' | 'in_progress' | 'completed';
  challenge_completed_by?: number;
  likes_count?: number;
  comments_count?: number;
  user_liked?: boolean;
}

export interface Comment {
  id: number;
  user_id: number;
  post_id: number;
  content: string;
  created_at: string;
  username?: string;
  user_profile_image?: string;
}

export interface AuthResponse {
  token: string;
  refresh_token: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface ApiError {
  message: string;
  status: number;
}