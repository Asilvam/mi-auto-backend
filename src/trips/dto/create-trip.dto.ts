import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateTripDto {
  @IsEnum(['shared', 'delivery']) type: string;
  @IsString() @MaxLength(160) origin: string;
  @IsString() @MaxLength(160) destination: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(2000000) distanceMeters: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(86400) durationSeconds?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) tollsClp?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) otherCostsClp?: number;
  @IsOptional() @IsDateString() completedAt?: string;
}
