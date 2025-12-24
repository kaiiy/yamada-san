/**
 * MIT License
 *
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB"];

export const format = (input: number) => {
	if (!Number.isSafeInteger(input) || input < 0) {
		throw new Error(`Expected a non-negative integer, got ${input}`);
	}
	if (input === 0) {
		return `0${BYTE_UNITS[0]}`;
	}

	const exponent = Math.min(
		Math.floor(Math.log10(input) / 3),
		BYTE_UNITS.length - 1,
	);
	const number = Number((input / 1000 ** exponent).toPrecision(3));
	const unit = BYTE_UNITS[exponent];

	return number.toString() + unit;
};
