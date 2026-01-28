import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeSQLViaPrepare } from "./sql-normalizer";
import type { WorkerBridge } from "../worker-bridge";

describe("normalizeSQLViaPrepare", () => {
  const mockWorkerBridge = {
    sendPrepareMsg: vi.fn(),
  } as unknown as WorkerBridge;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should normalize SQL with extra whitespace", async () => {
    const input = "CREATE  TABLE  test ( id  INTEGER );";
    const expected = "CREATE TABLE test(id INTEGER);";
    mockWorkerBridge.sendPrepareMsg = vi.fn().mockResolvedValue({
      normalizedSQL: expected,
    });

    const result = await normalizeSQLViaPrepare(input, mockWorkerBridge);
    expect(result).toBe(expected);
    expect(mockWorkerBridge.sendPrepareMsg).toHaveBeenCalledWith(input.trim());
  });

  it("should handle empty string", async () => {
    const result = await normalizeSQLViaPrepare("", mockWorkerBridge);
    expect(result).toBe("");
    expect(mockWorkerBridge.sendPrepareMsg).not.toHaveBeenCalled();
  });

  it("should handle whitespace-only string", async () => {
    const result = await normalizeSQLViaPrepare("   ", mockWorkerBridge);
    expect(result).toBe("");
    expect(mockWorkerBridge.sendPrepareMsg).not.toHaveBeenCalled();
  });

  it("should throw error for null input", async () => {
    await expect(
      normalizeSQLViaPrepare(null as unknown as string, mockWorkerBridge),
    ).rejects.toThrow("SQL cannot be null or undefined");
  });

  it("should throw error for undefined input", async () => {
    await expect(
      normalizeSQLViaPrepare(undefined as unknown as string, mockWorkerBridge),
    ).rejects.toThrow("SQL cannot be null or undefined");
  });

  it("should throw error for non-string input", async () => {
    await expect(
      normalizeSQLViaPrepare(123 as unknown as string, mockWorkerBridge),
    ).rejects.toThrow("SQL must be a string");
  });

  it("should remove SQL comments", async () => {
    const input = "CREATE TABLE test (id INTEGER); -- comment";
    const expected = "CREATE TABLE test(id INTEGER);";
    mockWorkerBridge.sendPrepareMsg = vi.fn().mockResolvedValue({
      normalizedSQL: expected,
    });

    const result = await normalizeSQLViaPrepare(input, mockWorkerBridge);
    expect(result).toBe(expected);
  });

  it("should standardize keyword casing", async () => {
    const input = "create table test (id integer);";
    const expected = "CREATE TABLE test(id INTEGER);";
    mockWorkerBridge.sendPrepareMsg = vi.fn().mockResolvedValue({
      normalizedSQL: expected,
    });

    const result = await normalizeSQLViaPrepare(input, mockWorkerBridge);
    expect(result).toBe(expected);
  });

  it("should propagate worker errors", async () => {
    const input = "INVALID SQL";
    mockWorkerBridge.sendPrepareMsg = vi
      .fn()
      .mockRejectedValue(new Error("syntax error"));

    await expect(
      normalizeSQLViaPrepare(input, mockWorkerBridge),
    ).rejects.toThrow("syntax error");
  });

  it("should normalize multi-statement SQL", async () => {
    const input =
      "CREATE TABLE users (id INTEGER); CREATE TABLE posts (id INTEGER);";
    const expected =
      "CREATE TABLE users(id INTEGER);CREATE TABLE posts(id INTEGER);";
    mockWorkerBridge.sendPrepareMsg = vi.fn().mockResolvedValue({
      normalizedSQL: expected,
    });

    const result = await normalizeSQLViaPrepare(input, mockWorkerBridge);
    expect(result).toBe(expected);
  });
});
