import { z } from "zod";

export const idSchema = z.string().max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const textSchema = z.string().trim().min(1);
export const turnSchema = z.number().int().nonnegative();
export const trustSchema = z.number().int().min(0).max(100);

export const idListSchema = z.array(idSchema).refine(
  (ids) => new Set(ids).size === ids.length,
  "ID list must not contain duplicates",
);
