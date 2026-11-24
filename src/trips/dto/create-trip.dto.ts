import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateTripDto {
  @IsEnum(['shared', 'delivery']) type: string;
  @IsOptional() @IsEnum(['planned', 'in_progress', 'completed']) status?: string;
  @IsString() @MaxLength(160) origin: string;
  @IsString() @MaxLength(160) destination: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(2000000) distanceMeters: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(86400) durationSeconds?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) tollsClp?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) otherCostsClp?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) participantCount?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000000) deliveryFeeClp?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(160, { each: true }) stops?: string[];
  @IsOptional() @IsObject() routeGeometry?: { type: 'LineString'; coordinates: [number, number][] };
  @IsOptional() @IsDateString() completedAt?: string;
}
