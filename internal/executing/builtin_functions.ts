import { Unreachable } from "../../errors.ts";
import { generateRandomNumber } from "./generators.ts";
import { FunctionRuntime, RegularFunction, Scope } from "./runtime.ts";
import {
  RuntimeError,
  RuntimeError_CallArgumentTypeMismatch,
  RuntimeError_IllegalOperation,
  RuntimeError_TypeMismatch,
  RuntimeError_WrongArity,
} from "./runtime_errors.ts";
import {
  EitherStepOrError,
  EitherValueOrError,
  EitherValuesOrError,
  GeneratorCallback,
  Step,
  Step_Plain,
} from "./steps.ts";
import {
  getTypeNameOfValue,
  Value,
  Value_Callable,
  Value_Generating,
  ValueTypeName,
} from "./values.ts";

export const builtinScope: Scope = {
  "||/2": makeFunction(["boolean", "boolean"], (args, _rtm) => {
    const [left, right] = args as [boolean, boolean];
    return [left || right, null];
  }),
  "&&/2": makeFunction(["boolean", "boolean"], (args, _rtm) => {
    const [left, right] = args as [boolean, boolean];
    return [left && right, null];
  }),

  "==/2": makeFunction(
    [["boolean", "number"], ["boolean", "number"]],
    (args, _rtm) => {
      const [left, right] = args as [boolean, boolean] | [number, number];
      if (typeof left !== typeof right) {
        return [null, error_LeftRightTypeMismatch("==")];
      }
      return [left === right, null];
    },
  ),
  "!=/2": makeFunction(
    [["boolean", "number"], ["boolean", "number"]],
    (args, _rtm) => {
      const [left, right] = args as [boolean, boolean] | [number, number];
      if (typeof left !== typeof right) {
        return [null, error_LeftRightTypeMismatch("!=")];
      }
      return [left !== right, null];
    },
  ),

  "</2": makeFunction(["number", "number"], (args, _rtm) => {
    const [left, right] = args as [number, number];
    return [left < right, null];
  }),
  ">/2": makeFunction(["number", "number"], (args, _rtm) => {
    const [left, right] = args as [number, number];
    return [left > right, null];
  }),
  "<=/2": makeFunction(["number", "number"], (args, _rtm) => {
    const [left, right] = args as [number, number];
    return [left <= right, null];
  }),
  ">=/2": makeFunction(["number", "number"], (args, _rtm) => {
    const [left, right] = args as [number, number];
    return [left >= right, null];
  }),

  "|>/2": (_args, _rtm) => {
    const [calling, errCalling] = _args[1].calling;
    if (errCalling instanceof RuntimeError) return [null, errCalling];
    if (errCalling) {
      return [
        null,
        new RuntimeError_IllegalOperation("|>", "???????????????????????????"),
      ];
    }
    const newCalling = calling.withArgs([_args[0], ...calling.args]);
    // TODO?: Step_Pipe
    return [new Step_Plain(newCalling), null];
  },

  // #/2

  "~/2": makeFunction(["number", "number"], (args, rtm) => {
    const bounds = args.sort() as [number, number];

    const cb: GeneratorCallback = {
      kind: "simple_number",
      fn: () => generateRandomNumber(rtm.random, bounds),
    };
    const g = new Value_Generating("sum", 1, "integer", cb, bounds);
    // FIXME: replacingStep: new Step_CreateGenerator(???)
    //        ?????? ~/1???d/2???d%/2???d/1???d%/1 ???????????????
    return [g, null];
  }),
  "~/1": makeFunction(["number"], (args, rtm) => {
    const [right] = args as [number];
    const errRange = ensureUpperBound("~", null, 1, right);
    if (errRange) return [null, errRange];
    const bounds: [number, number] = [1, right];

    const cb: GeneratorCallback = {
      kind: "simple_number",
      fn: () => generateRandomNumber(rtm.random, bounds),
    };
    const g = new Value_Generating("sum", 1, "integer", cb, bounds);
    return [g, null];
  }),

  "+/2": makeFunction(["number", "number"], (args, _rtm) => {
    const [left, right] = args as [number, number];
    return [left + right, null];
  }),
  "-/2": makeFunction(["number", "number"], (args, _rtm) => {
    const [left, right] = args as [number, number];
    return [left - right, null];
  }),
  "+/1": makeFunction(["number"], (args, _rtm) => {
    const [right] = args as [number];
    return [+right, null];
  }),
  "-/1": makeFunction(["number"], (args, _rtm) => {
    const [right] = args as [number];
    return [-right, null];
  }),

  "*/2": makeFunction(["number", "number"], (args, _rtm) => {
    const [left, right] = args as [number, number];
    return [left * right, null];
  }),
  "///2": makeFunction(["number", "number"], (args, _rtm) => {
    const [left, right] = args as [number, number];
    if (right === 0) {
      const opRendered = renderOperation("//", `${left}`, `${right}`);
      const reason = "??????????????????";
      return [null, new RuntimeError_IllegalOperation(opRendered, reason)];
    }
    return [left / right | 0, null];
  }),
  "%/2": makeFunction(["number", "number"], (args, _rtm) => {
    const [left, right] = args as [number, number];
    if (left < 0) {
      const leftText = left < 0 ? `(${left})` : `${left}`;
      const opRendered = renderOperation("%", leftText, `${right}`);
      const reason = "????????????????????????";
      return [null, new RuntimeError_IllegalOperation(opRendered, reason)];
    } else if (right <= 0) {
      const leftText = left < 0 ? `(${left})` : `${left}`;
      const opRendered = renderOperation("%", leftText, `${right}`);
      const reason = "?????????????????????";
      return [null, new RuntimeError_IllegalOperation(opRendered, reason)];
    }
    return [(left | 0) % right, null];
  }),

  "d/2": makeFunction(["number", "number"], (args, rtm) => {
    const [n, right] = args as [number, number];
    const errRange = ensureUpperBound("d", 1, 1, right);
    if (errRange) return [null, errRange];
    const bounds: [number, number] = [1, right];

    const cb: GeneratorCallback = {
      kind: "simple_number",
      fn: () => generateRandomNumber(rtm.random, bounds),
    };
    const g = new Value_Generating("sum", n, "integer", cb, bounds);
    return [g, null];
  }),
  "d/1": makeFunction(["number"], (args, rtm) => { // TODO: makeUnaryRedirection("d", 1)
    const [right] = args as [number];
    const errRange = ensureUpperBound("d", 1, 1, right);
    if (errRange) return [null, errRange];
    const bounds: [number, number] = [1, right];

    const cb: GeneratorCallback = {
      kind: "simple_number",
      fn: () => generateRandomNumber(rtm.random, bounds),
    };
    const g = new Value_Generating("sum", 1, "integer", cb, bounds);
    return [g, null];
  }),
  "d%/2": makeFunction(["number", "number"], (args, rtm) => {
    const [n, right] = args as [number, number];
    const actualText = `${right}-1=${right - 1}`;
    const errRange = ensureUpperBound("d%", 1, 0, right - 1, actualText);
    if (errRange) return [null, errRange];
    const bounds: [number, number] = [0, right - 1];

    const cb: GeneratorCallback = {
      kind: "simple_number",
      fn: () => generateRandomNumber(rtm.random, bounds),
    };
    const g = new Value_Generating("sum", n, "integer", cb, bounds);
    return [g, null];
  }),
  "d%/1": makeFunction(["number"], (args, rtm) => { // TODO: makeUnaryRedirection("d%", 1)
    const [right] = args as [number];
    const actualText = `${right}-1=${right - 1}`;
    const errRange = ensureUpperBound("d%", 1, 0, right - 1, actualText);
    if (errRange) return [null, errRange];
    const bounds: [number, number] = [0, right - 1];

    const cb: GeneratorCallback = {
      kind: "simple_number",
      fn: () => generateRandomNumber(rtm.random, bounds),
    };
    const g = new Value_Generating("sum", 1, "integer", cb, bounds);
    return [g, null];
  }),

  "^/2": makeFunction(["number", "number"], (args, _rtm) => {
    const [left, right] = args as [number, number];
    if (right < 0) {
      const opRendered = renderOperation("^", `${left}`, `${right}`);
      const reason = "?????????????????????";
      return [null, new RuntimeError_IllegalOperation(opRendered, reason)];
    }
    return [left ** right, null];
  }),

  "!/1": makeFunction(["boolean"], (args, _rtm) => {
    const [right] = args as [boolean];
    return [!right, null];
  }),
  //

  // ????????????
  // reroll/2
  // explode/2

  // ?????????
  // abs/1
  // count/1
  // has?/2
  "sum/1": makeFunction(["list"], ([list_], _rtm) => {
    const [flatten_, err] = flattenListAll("number", list_ as Step[]);
    if (err) return [null, err];
    return [(flatten_ as number[]).reduce((acc, cur) => acc + cur), null];
  }),
  "product/1": makeFunction(["list"], ([list_], _rtm) => {
    const [flatten_, err] = flattenListAll("number", list_ as Step[]);
    if (err) return [null, err];
    return [(flatten_ as number[]).reduce((acc, cur) => acc * cur), null];
  }),
  // min/1
  // max/1
  // all/1
  // any/1
  "sort/1": makeFunction(["list"], ([list_], _rtm) => {
    const allowedTypes = ["number", "boolean"] as ValueTypeName[];
    const [unwrappedList, err] = unwrapListOneOf(allowedTypes, list_ as Step[]);
    if (err) return [null, err];
    return [unwrappedList.sort().map((el) => new Step_Plain(el)), null];
  }),
  // sort/2
  // reverse/1
  // concat/2
  // prepend/2
  "append/2": makeFunction(["list", "*"], ([list_, el], _rtm) => { // FIXME: ?????? laziness
    return [[...(list_ as Step[]), new Step_Plain(el)], null];
  }),
  "at/2": makeFunction(["list", "number"], (args, _rtm) => { // FIXME: ?????? laziness
    const [list, i] = args as [Step[], number];
    if (i >= list.length || i < 0) {
      const err = new RuntimeError(
        `???????????????????????????????????? ${list.length}????????????????????? ${i}`,
      );
      return [null, err];
    }
    const el = list[i];
    return el.result;
  }),
  // at/3
  // duplicate/2
  // flatten/2
  // flattenAll/1

  // ????????????
  "map/2": makeFunction(["list", "callable"], (args, _rtm) => { // FIXME: ????????????
    const [list, callable] = args as [Step[], Value_Callable];
    const result = list.map((el) => new Step_Plain(callable.makeCalling([el])));
    return [result, null];
  }),
  // flatMap/2
  "filter/2": makeFunction(["list", "callable"], (args, _rtm) => { // FIXME: ????????????
    const [list, callable] = args as [Step[], Value_Callable];

    const result: Step[] = [];
    for (const el of list) {
      const step = new Step_Plain(callable.makeCalling([el]));
      const [value, err] = step.result;
      if (err) return [null, err];
      if (typeof value !== "boolean") {
        const err = error_givenClosureReturnValueTypeMismatch(
          "filter/2",
          "boolean",
          getTypeNameOfValue(value),
          2,
        );
        return [null, err];
      }
      if (!value) continue;
      result.push(el);
    }
    return [result, null];
  }),
  // foldl/3
  // foldr/3
  "head/1": makeFunction(["list"], (args, _rtm) => { // FIXME: ?????? laziness
    const [list] = args as [Step[]];
    if (list.length === 0) return [null, new RuntimeError("????????????")];
    return list[0].result;
  }),
  "tail/1": makeFunction(["list"], (args, _rtm) => { // FIXME: ?????? laziness
    const [list] = args as [Step[]];
    if (list.length === 0) return [null, new RuntimeError("????????????")];
    return [list.slice(1), null];
  }),
  // last/1
  // init/1
  // take/2
  // takeWhile/2
  // drop/2
  // dropWhile/2
  "zip/2": makeFunction(["list", "list"], (args, _rtm) => {
    const [left, right] = args as [Step[], Step[]];
    const zippedLength = Math.min(left.length, right.length);
    const result = Array(zippedLength);
    for (let i = 0; i < zippedLength; i++) {
      result[i] = [left[i], right[i]];
    }
    return [result, null];
  }),
  "zipWith/3": makeFunction(["list", "list", "callable"], (args, _rtm) => {
    const [left, right, fn] = args as [Step[], Step[], Value_Callable];
    const zippedLength = Math.min(left.length, right.length);
    const result = Array(zippedLength);
    for (let i = 0; i < zippedLength; i++) {
      result[i] = new Step_Plain(fn.makeCalling([left[i], right[i]]));
    }
    return [result, null];
  }),

  // ?????????
  // TODO: rtm.inspect ?????????
  // FIXME: ????????? laziness
  "inspect!/1": (args_, _rtm) => {
    const [target] = args_;
    const [value, error] = unwrapValue("*", target);
    if (error) {
      console.log(Deno.inspect({ error }));
    } else {
      console.log(Deno.inspect({ value }));
    }
    return [target, error] as EitherStepOrError;
  },

  "if!/3": (args_, _rtm) => { // FIXME ????????? laziness
    const [cond, errCond] = unwrapValue("boolean", args_[0]);
    if (errCond) return [null, errCond];

    if (cond) {
      return [args_[1], null];
    } else {
      return [args_[2], null];
    }
  },
};

export type ExpectedValueTypeName = ValueTypeName | "callable";
type ArgumentSpec = ExpectedValueTypeName | "*" | ExpectedValueTypeName[];

function makeFunction(
  spec: ArgumentSpec[],
  logic: (args: Value[], rtm: FunctionRuntime) => EitherValueOrError,
): RegularFunction {
  return (args_, rtm) => {
    const [args, errUnwrap] = unwrapArguments(spec, args_);
    if (errUnwrap) return [null, errUnwrap];
    const [resultValue, resultError] = logic(args, rtm);
    if (resultError) {
      return [null, resultError];
    } else {
      return [new Step_Plain(resultValue), null];
    }
  };
}

function unwrapArguments(
  spec: ArgumentSpec[],
  args: Step[],
): EitherValuesOrError {
  if (spec.length !== args.length) {
    return [null, new RuntimeError_WrongArity(spec.length, args.length)];
  }

  const values: Value[] = Array(args.length);

  for (const [i, arg] of args.entries()) {
    const [value, err] = unwrapValue(spec[i], arg, { nth: i + 1 });
    if (err) return [null, err];
    values[i] = value;
  }

  return [values, null];
}

function unwrapValue(
  spec: ArgumentSpec,
  step: Step,
  opts?: CheckTypeOptions,
): EitherValueOrError {
  const [value, errEval] = step.result;
  if (errEval) return [null, errEval];

  const errType = checkType(spec, getTypeNameOfValue(value), opts);
  if (errType) return [null, errType];

  return [value, null];
}

interface CheckTypeOptions {
  nth?: number;
  kind?: RuntimeError_TypeMismatch["kind"];
}

function checkType(
  expected: ArgumentSpec,
  actual: ValueTypeName,
  opts: CheckTypeOptions = {},
): null | RuntimeError_TypeMismatch | RuntimeError_CallArgumentTypeMismatch {
  if (expected === "*") return null;
  if (Array.isArray(expected)) {
    if (expected.findIndex((x) => testType(x, actual)) >= 0) return null;
  } else if (testType(expected, actual)) {
    return null;
  }
  if (opts.nth !== undefined) {
    const nth = opts.nth;
    return new RuntimeError_CallArgumentTypeMismatch(nth, expected, actual);
  } else {
    return new RuntimeError_TypeMismatch(expected, actual, opts.kind ?? null);
  }
}

function testType(expected: ExpectedValueTypeName, actual: ValueTypeName) {
  if (expected === actual) return true;
  if (expected === "callable") {
    return actual === "closure" || actual === "captured";
  }
  return false;
}

export function getTypeDisplayName(name: ExpectedValueTypeName) {
  switch (name) {
    case "number":
      return "??????";
    case "boolean":
      return "??????";
    case "list":
      return "??????";
    case "closure":
      return "????????????";
    case "captured":
      return "????????????????????????";
    case "calling":
      return "?????????????????????????????????";
    case "callable":
      return "????????????????????????????????????";
    default:
      return `?????????????????????????????????${name}???`;
  }
}

/**
 * @param spec ??????????????????????????????????????????????????????
 * @param list
 */
function flattenListAll(spec: ArgumentSpec, list: Step[]): EitherValuesOrError {
  if (spec !== "*") {
    if (Array.isArray(spec)) {
      if (spec.at(-1) !== "list") {
        spec = [...spec, "list"];
      }
    } else {
      spec = [spec, spec];
    }
  }

  const values: Value[] = [];

  for (const [i, elem] of list.entries()) {
    const [value, err] = unwrapValue(spec, elem);
    if (err) return [null, err];

    if (getTypeNameOfValue(value) === "list") {
      const [subList, errSubList] = flattenListAll(spec, value as Step[]);
      if (errSubList) return [null, errSubList];
      values.push(...subList);
    } else {
      values[i] = value;
    }
  }

  return [values, null];
}

// function unwrapList(spec: ArgumentSpec, list: Step[]): EitherValuesOrError {
//   const values: Value[] = Array(list.length);

//   for (const [i, elem] of list.entries()) {
//     const [value, err] = unwrapValue(spec, elem);
//     if (err) return [null, err];
//     values[i] = value;
//   }

//   return [values, null];
// }

/**
 * FIXME: ?????????????????????????????????????????????????????????????????????????????????????????????
 * @param specOneOf
 * @param list
 * @returns
 */
function unwrapListOneOf(
  specOneOf: ValueTypeName[],
  list: Step[],
): EitherValuesOrError {
  if (!list.length) return [[], null];

  const values: Value[] = Array(list.length);
  let firstType: ValueTypeName;

  for (const [i, elem] of list.entries()) {
    let value, err;
    if (i === 0) {
      [value, err] = unwrapValue(specOneOf, elem);
    } else {
      [value, err] = unwrapValue(firstType!, elem, {
        kind: "list-inconsistency",
      });
    }
    if (err) return [null, err];
    if (i === 0) {
      firstType = getTypeNameOfValue(value!);
    }
    values[i] = value!;
  }

  return [values, null];
}

function ensureUpperBound(
  op: string,
  left: number | null,
  min: number,
  actual: number,
  actualText: string | null = null,
): null | RuntimeError_IllegalOperation {
  if (actual < min) {
    const leftText = left === null ? null : `${left}`;
    const opRendered = renderOperation(op, leftText, `${actual}`);
    const reason = `???????????????${actualText ?? actual}??????????????? ${min}`;
    return new RuntimeError_IllegalOperation(opRendered, reason);
  }
  return null;
}

function renderOperation(
  op: string,
  left: string | null,
  right: string | null,
) {
  if (left === null && right === null) throw new Unreachable();
  if (left === null) {
    return `${op} ${right}`;
  } else if (right === null) {
    return `${left} ${op}`;
  }
  return `${left} ${op} ${right}`;
}

function error_LeftRightTypeMismatch(op: string) {
  const reason = "?????????????????????????????????";
  return new RuntimeError_IllegalOperation(op, reason);
}

function error_givenClosureReturnValueTypeMismatch(
  name: string,
  expectedReturnValueType: "number" | "boolean",
  actualReturnValueType: ValueTypeName,
  position: number,
) {
  const expectedTypeText = getTypeDisplayName(expectedReturnValueType);
  const actualTypeText = getTypeDisplayName(actualReturnValueType);
  return new RuntimeError(
    `????????? ${position} ??????????????????????????? ${name} ????????????????????????????????????` +
      `?????????${expectedTypeText}???????????????${actualTypeText}??????`,
  );
}
