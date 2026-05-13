import { v4 as uuid } from "uuid";

/** Single source of truth for ID generation — easy to swap to ULID later. */
export const newId = (): string => uuid();
