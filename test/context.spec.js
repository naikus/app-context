/**
 * @typedef {import("../types").AppContext} AppContext
 * @typedef {import("../types").ModuleDefn} ModuleDefn
 */

import {expect, test, beforeEach, afterEach, describe} from "vitest";
import {create, createNsEmitter} from "../index";

beforeEach(() => {});
afterEach(() => {});

let appContext;
describe("App context tests", () => {
  test("Create Instance", () => {
    appContext = create();
    expect(appContext).not.toBeNull();
  });
});