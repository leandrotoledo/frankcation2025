import { AuthResponse, LoginRequest, RegisterRequest, User, Challenge, Post, Comment, ApiError } from '../types';
import storage from '../utils/storage';

// Get API base URL from environment variables
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080';

// Log API URL in development for debugging
if (process.env.EXPO_PUBLIC_ENVIRONMENT === 'development' && process.env.EXPO_PUBLIC_ENABLE_DEBUG === 'true') {
  console.log('🌐 API Base URL:', API_BASE_URL);
}

class ApiService {
  private async getAuthToken(): Promise<string | null> {
    try {
      return await storage.getItem('authToken');
    } catch (error) {
      return null;
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText || 'Network request failed');
      (error as any).status = response.status;
      throw error;
    }

    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return response.text() as unknown as T;
  }

  private async makeFormRequest<T>(
    endpoint: string,
    formData: FormData,
    method: string = 'POST'
  ): Promise<T> {
    const token = await this.getAuthToken();
    
    const headers: HeadersInit = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText || 'Network request failed');
      (error as any).status = response.status;
      throw error;
    }

    return response.json();
  }

  // Authentication
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return this.makeRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    return this.makeRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // User
  async getProfile(): Promise<User> {
    return this.makeRequest<User>('/users/profile');
  }

  async updateProfile(formData: FormData): Promise<User> {
    return this.makeFormRequest<User>('/users/profile', formData, 'PUT');
  }

  async getUser(userId: number): Promise<User> {
    return this.makeRequest<User>(`/users/${userId}`);
  }

  // Challenges
  async getChallenges(): Promise<Challenge[]> {
    return this.makeRequest<Challenge[]>('/challenges');
  }

  async getChallenge(challengeId: number): Promise<Challenge> {
    return this.makeRequest<Challenge>(`/challenges/${challengeId}`);
  }

  async pickChallenge(challengeId: number): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/challenges/${challengeId}/pick`, {
      method: 'POST',
    });
  }

  async cancelChallenge(challengeId: number): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/challenges/${challengeId}/cancel`, {
      method: 'POST',
    });
  }

  // Background media upload (returns temporary media ID)
  async uploadMedia(formData: FormData): Promise<{
    media_id: string;
    media_url: string;
  }> {
    const token = await this.getAuthToken();
    
    const headers: HeadersInit = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/media/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText || 'Network request failed');
      (error as any).status = response.status;
      throw error;
    }

    return response.json();
  }

  async completeChallenge(challengeId: number, data: {
    media_id?: string;
    caption?: string;
    formData?: FormData; // Fallback for direct upload
  }): Promise<{
    message: string;
    post_id: number;
    points_earned: number;
  }> {
    const token = await this.getAuthToken();
    
    const headers: HeadersInit = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let body: FormData | string;
    
    if (data.media_id) {
      // Use pre-uploaded media
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        media_id: data.media_id,
        caption: data.caption
      });
    } else if (data.formData) {
      // Fallback to direct upload
      body = data.formData;
    } else {
      throw new Error('Either media_id or formData must be provided');
    }

    const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}/complete`, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      const error = new Error(errorText || 'Network request failed');
      (error as any).status = response.status;
      throw error;
    }

    return response.json();
  }

  // Admin Challenges
  async getAllChallenges(): Promise<Challenge[]> {
    return this.makeRequest<Challenge[]>('/admin/challenges');
  }

  async createChallenge(formData: FormData): Promise<Challenge> {
    return this.makeFormRequest<Challenge>('/admin/challenges', formData);
  }

  async unassignChallenge(challengeId: number): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/admin/challenges/${challengeId}/unassign`, {
      method: 'POST',
    });
  }

  async deleteChallenge(challengeId: number): Promise<void> {
    return this.makeRequest<void>(`/admin/challenges/${challengeId}`, {
      method: 'DELETE',
    });
  }

  async awardChallenge(challengeId: number, userId: number): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/admin/challenges/${challengeId}/award`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  // Feed
  async getFeed(page: number = 1, limit: number = 20): Promise<Post[]> {
    return this.makeRequest<Post[]>(`/feed?page=${page}&limit=${limit}`);
  }

  async getPost(postId: number): Promise<Post> {
    return this.makeRequest<Post>(`/posts/${postId}`);
  }

  async deletePost(postId: number): Promise<void> {
    return this.makeRequest<void>(`/posts/${postId}`, {
      method: 'DELETE',
    });
  }

  async revokePostPoints(postId: number): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/admin/posts/${postId}/revoke`, {
      method: 'POST',
    });
  }

  // Social
  async likePost(postId: number): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/posts/${postId}/like`, {
      method: 'POST',
    });
  }

  async unlikePost(postId: number): Promise<{ message: string }> {
    return this.makeRequest<{ message: string }>(`/posts/${postId}/like`, {
      method: 'DELETE',
    });
  }

  async getComments(postId: number): Promise<Comment[]> {
    return this.makeRequest<Comment[]>(`/posts/${postId}/comments`);
  }

  async createComment(postId: number, content: string): Promise<Comment> {
    return this.makeRequest<Comment>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Leaderboard
  async getLeaderboard(): Promise<User[]> {
    return this.makeRequest<User[]>('/leaderboard');
  }

  // Utility
  getMediaUrl(path: string): string {
    if (!path) {
      return ''; // Return empty string for undefined/null paths
    }
    if (path.startsWith('http')) {
      return path;
    }
    return `${API_BASE_URL}${path}`;
  }
}

export const apiService = new ApiService();
export default apiService;