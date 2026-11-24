import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly users: Model<UserDocument>) {}

  async findOrCreateGoogleUser(profile: { sub: string; email: string; name?: string; picture?: string }): Promise<UserDocument> {
    return this.users.findOneAndUpdate(
      { googleSubject: profile.sub },
      { $set: { email: profile.email, name: profile.name ?? '', pictureUrl: profile.picture ?? '', authProvider: 'google' } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
  }

  findById(id: string) {
    return this.users.findById(id).select('_id email name pictureUrl').lean().exec();
  }
}
