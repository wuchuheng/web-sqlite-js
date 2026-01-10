import { describe, it, expect, beforeEach, vi } from "vitest";
import { createLogDispatcher } from "./log-dispatcher";
import type { LogEntry } from "../types/DB";

describe("LogDispatcher (TASK-207)", () => {
  let dispatcher: ReturnType<typeof createLogDispatcher>;

  beforeEach(() => {
    dispatcher = createLogDispatcher();
  });

  it("should register callback and return cancel function", () => {
    const callback = vi.fn();
    const cancel = dispatcher.register(callback);

    expect(typeof cancel).toBe("function");
    expect(dispatcher._getCallbackCount()).toBe(1);
  });

  it("should dispatch log to single callback", () => {
    const callback = vi.fn();
    dispatcher.register(callback);

    const log: LogEntry = {
      level: "debug",
      data: { sql: "SELECT * FROM users" },
    };
    dispatcher.dispatch(log);

    expect(callback).toHaveBeenCalledWith(log);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should dispatch log to multiple callbacks", () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    dispatcher.register(callback1);
    dispatcher.register(callback2);

    const log: LogEntry = {
      level: "info",
      data: { action: "commit" },
    };
    dispatcher.dispatch(log);

    expect(callback1).toHaveBeenCalledWith(log);
    expect(callback2).toHaveBeenCalledWith(log);
  });

  it("should cancel callback when cancel function is called", () => {
    const callback = vi.fn();
    const cancel = dispatcher.register(callback);

    cancel();
    dispatcher.dispatch({ level: "debug", data: {} });

    expect(callback).not.toHaveBeenCalled();
    expect(dispatcher._getCallbackCount()).toBe(0);
  });

  it("should be idempotent (cancel can be called multiple times)", () => {
    const callback = vi.fn();
    const cancel = dispatcher.register(callback);

    cancel();
    cancel();
    cancel(); // Should not error

    expect(dispatcher._getCallbackCount()).toBe(0);
  });

  it("should isolate callback errors (error in one callback doesn't break others)", () => {
    const errorCallback = vi.fn(() => {
      throw new Error("Callback error");
    });
    const goodCallback = vi.fn();

    dispatcher.register(errorCallback);
    dispatcher.register(goodCallback);

    const log: LogEntry = { level: "debug", data: {} };
    dispatcher.dispatch(log);

    expect(errorCallback).toHaveBeenCalled();
    expect(goodCallback).toHaveBeenCalled();
  });

  it("should allow re-registering a canceled callback", () => {
    const callback = vi.fn();
    const cancel1 = dispatcher.register(callback);

    cancel1();
    expect(dispatcher._getCallbackCount()).toBe(0);

    dispatcher.register(callback);
    expect(dispatcher._getCallbackCount()).toBe(1);

    dispatcher.dispatch({ level: "debug", data: {} });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should handle empty dispatcher (dispatch with no callbacks)", () => {
    expect(() => {
      dispatcher.dispatch({ level: "debug", data: {} });
    }).not.toThrow();
  });

  it("should create independent dispatcher instances", () => {
    const dispatcher1 = createLogDispatcher();
    const dispatcher2 = createLogDispatcher();

    const callback1 = vi.fn();
    const callback2 = vi.fn();

    dispatcher1.register(callback1);
    dispatcher2.register(callback2);

    const log: LogEntry = { level: "debug", data: {} };

    dispatcher1.dispatch(log);
    dispatcher2.dispatch(log);

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
    expect(dispatcher1._getCallbackCount()).toBe(1);
    expect(dispatcher2._getCallbackCount()).toBe(1);
  });
});
