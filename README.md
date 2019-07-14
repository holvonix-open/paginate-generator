# paginate-generator -  An async generator facade for paginated APIs

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE) [![npm](https://img.shields.io/npm/v/paginate-generator.svg)](https://www.npmjs.com/package/paginate-generator) [![Build Status](https://travis-ci.com/holvonix-open/paginate-generator.svg?branch=master)](https://travis-ci.com/holvonix-open/paginate-generator) [![GitHub last commit](https://img.shields.io/github/last-commit/holvonix-open/paginate-generator.svg)](https://github.com/holvonix-open/paginate-generator/commits) [![codecov](https://codecov.io/gh/holvonix-open/paginate-generator/branch/master/graph/badge.svg)](https://codecov.io/gh/holvonix-open/paginate-generator) [![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=holvonix-open/paginate-generator)](https://dependabot.com) [![DeepScan grade](https://deepscan.io/api/teams/4465/projects/6380/branches/52918/badge/grade.svg)](https://deepscan.io/dashboard#view=project&tid=4465&pid=6380&bid=52918) [![Code Style: Google](https://img.shields.io/badge/code%20style-google-blueviolet.svg)](https://github.com/google/gts)


## Quick Start

After `yarn add paginate-generator`:

````typescript
import { paginate, all } from 'paginate-generator';

// paginatedApi will be called until it either returns no next token,
// or max items have been retrieved (if defined).
async function getIt(max : number) {
  // all neatly gathers the pages into one array, but it may be more
  // efficient to directly use "for await" on the paginate(...) call.
  return all(paginate(async (token?: number) => {
    // token will be undefined on first page (unless you pass one as the second param)
    const apiReturn = await paginatedApi(token || 0);
    return {
      // should be undefined when no more pages to request
      next: apiReturn.nextToken,
      page: apiReturn.items,
    };
  }, undefined, max));
}
````


## License

Read the [LICENSE](LICENSE) for details.  
The entire [NOTICE](NOTICE) file serves as the NOTICE that must be included under
Section 4d of the License.

````

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

````
