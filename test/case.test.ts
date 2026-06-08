import { describe, it, expect } from 'vitest';
import {
  toCamel,
  toConstant,
  toKebab,
  toPascal,
  toSentence,
  toSlug,
  toSnake,
  toTitle,
  tokenize,
} from '../src/apps/case/logic';

describe('case converter', () => {
  it('tokenizes across camel, snake, kebab and spaces', () => {
    expect(tokenize('helloWorld-foo_bar baz')).toEqual(['hello', 'world', 'foo', 'bar', 'baz']);
  });

  it('splits acronym boundaries', () => {
    expect(tokenize('parseJSONString')).toEqual(['parse', 'json', 'string']);
  });

  it('produces each target case', () => {
    const s = 'hello world-foo';
    expect(toCamel(s)).toBe('helloWorldFoo');
    expect(toPascal(s)).toBe('HelloWorldFoo');
    expect(toSnake(s)).toBe('hello_world_foo');
    expect(toKebab(s)).toBe('hello-world-foo');
    expect(toConstant(s)).toBe('HELLO_WORLD_FOO');
    expect(toTitle(s)).toBe('Hello World Foo');
    expect(toSentence(s)).toBe('Hello world foo');
  });

  it('strips punctuation when slugifying', () => {
    expect(toSlug('Hello, World!')).toBe('hello-world');
  });

  it('handles empty input gracefully', () => {
    expect(toCamel('')).toBe('');
    expect(toSentence('')).toBe('');
  });
});
