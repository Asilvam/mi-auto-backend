import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PlanRouteDto {
  @IsString() @MaxLength(160) origin: string;
  @IsString() @MaxLength(160) destination: string;
  @IsOptional() @Type(() => Number) @IsArray() @ArrayMinSize(2) @ArrayMaxSize(2) @IsNumber({}, { each: true }) destinationCoordinates?: number[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) stops?: string[];
  @IsOptional() @IsEnum(['shared', 'delivery']) type?: 'shared' | 'delivery';
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) tollsClp?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10000000) otherCostsClp?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) participantCount?: number;
}
