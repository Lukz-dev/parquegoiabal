-- Add isBox and unitsPerBox columns to Product table
ALTER TABLE "Product" ADD COLUMN "isBox" boolean NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "unitsPerBox" integer;
