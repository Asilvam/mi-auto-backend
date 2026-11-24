import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpsertVehicleDto {
  @IsString() @MaxLength(60) name: string;
  @IsOptional() @IsString() @MaxLength(60) make?: string;
  @IsOptional() @IsString() @MaxLength(60) model?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1950) @Max(2100) year?: number;
  @IsOptional() @IsEnum(['gasoline', 'diesel', 'hybrid', 'electric', 'other']) fuelType?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(100) efficiencyKmPerLiter: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) fuelPriceClp: number;
}
