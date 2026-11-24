import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateActiveRouteDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(2000000) distanceMeters: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(86400) durationSeconds?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) tollsClp?: number;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(160, { each: true }) stops?: string[];
  @IsObject() routeGeometry: { type: 'LineString'; coordinates: [number, number][] };
}
