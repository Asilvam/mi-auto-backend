import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true, versionKey: false })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ unique: true, sparse: true })
  googleSubject?: string;

  @Prop({ trim: true, default: '' })
  name: string;

  @Prop({ default: '' })
  pictureUrl: string;

  @Prop({ default: 'google' })
  authProvider: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
