import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class DeliveryRateDto {
  @IsString() @MaxLength(40) id: string;
  @IsString() @MaxLength(40) label: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) startTime: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/) endTime: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) amountClp: number;
}

export class SaveDeliveryPricingDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => DeliveryRateDto)
  rules: DeliveryRateDto[];
}
