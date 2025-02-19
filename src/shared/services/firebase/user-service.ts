import { User } from '@/shared/types/user';
import { FirestoreService } from './firestore-service';

export class UserService extends FirestoreService<User> {
  constructor() {
    super('users');
  }

  // Add user-specific methods here as needed
  async createUserProfile(user: User): Promise<void> {
    await this.create(user.userId, user);
  }

  async getUserProfile(userId: string): Promise<User | null> {
    return this.get(userId);
  }

  async updateUserProfile(userId: string, data: Partial<User>): Promise<void> {
    await this.update(userId, data);
  }
}

export const userService = new UserService(); 