/*!
# paginate-generator

This product contains software originally developed by Holvonix LLC.
Original Repository: https://github.com/holvonix-open/paginate-generator

Copyright (c) 2019 Holvonix LLC. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this software except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Third-party dependencies may have their own licenses.
*/

export async function* paginate<T, U>(
  func: (token?: U) => Promise<{ page: T[]; next?: U }>,
  token?: U,
  maxCount?: number
) {
  let next = token;
  let doneCount = 0;
  do {
    const ret = await func(next);
    const allEntries = ret.page;
    const yielded = allEntries.slice(
      0,
      maxCount === undefined ? allEntries.length : maxCount - doneCount
    );
    doneCount += yielded.length;
    yield* yielded;
    next = ret.next;
  } while (next && (maxCount === undefined || doneCount < maxCount));
}

export async function all<T>(a: AsyncIterableIterator<T>) {
  const ret: T[] = [];
  for await (const e of a) {
    ret.push(e);
  }
  return ret;
}

export interface ItemOrError<T> {
  item?: T;
  // tslint:disable-next-line:no-any
  error?: any;
}

export async function allUntilError<T>(a: AsyncIterableIterator<T>) {
  const ret: Array<ItemOrError<T>> = [];
  try {
    for await (const e of a) {
      ret.push({ item: e });
    }
  } catch (e) {
    ret.push({ error: e });
  }
  return ret;
}
