import { EqualityFilter } from "ldapts";
import { AppError } from "../../../shared/errors/app-error.js";

/** AD objectGUID has little-endian first three fields; the remaining eight bytes retain order. */
export function decodeDirectoryGuid(value: unknown): string {
  if (!Buffer.isBuffer(value) || value.length !== 16)
    throw new AppError({
      statusCode: 503,
      code: "DIRECTORY_IDENTITY_UNAVAILABLE",
      message: "The directory did not return a valid immutable identity.",
    });
  const bytes = Buffer.from(value);
  bytes.subarray(0, 4).reverse();
  bytes.subarray(4, 6).reverse();
  bytes.subarray(6, 8).reverse();
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function encodeDirectoryGuid(value: string): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))
    throw new AppError({
      statusCode: 422,
      code: "INVALID_DIRECTORY_IDENTITY",
      message: "Choose a valid directory identity.",
    });
  const bytes = Buffer.from(value.replaceAll("-", ""), "hex");
  bytes.subarray(0, 4).reverse();
  bytes.subarray(4, 6).reverse();
  bytes.subarray(6, 8).reverse();
  return [...bytes].map((byte) => "\\" + byte.toString(16).padStart(2, "0")).join("");
}

/** Preserve octets on the wire; LDAP string parsing re-encodes high bytes as UTF-8. */
export function directoryGuidFilter(guid: string): EqualityFilter {
  const bytes = Buffer.from(encodeDirectoryGuid(guid).replaceAll("\\", ""), "hex");
  return new EqualityFilter({ attribute: "objectGUID", value: bytes });
}
