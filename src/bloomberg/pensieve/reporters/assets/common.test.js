import {
  humanFileSize,
  makeTooltipString,
  filterChildThreads,
  sumAllocations,
  filterUninteresting,
} from "./common";

test("handlesSmallValues", () => {
  expect(humanFileSize(0)).toBe("0 B");
  expect(humanFileSize(128)).toBe("128 B");
  expect(humanFileSize(1023)).toBe("1023 B");
});

describe("Flame graph tooltip generation", () => {
  test("Generate label without thread", () => {
    const data = {
      location: ["foo", "foo.py", "10"],
      n_allocations: 3,
      thread_id: -1,
    };
    expect(makeTooltipString(data, "1KiB", true)).toBe(
      "File foo.py, line 10 in foo<br>1KiB total<br>3 allocations"
    );
  });

  test("Generate label with thread", () => {
    const data = {
      location: ["foo", "foo.py", "10"],
      n_allocations: 3,
      thread_id: 1,
    };
    expect(makeTooltipString(data, "1KiB", false)).toBe(
      "File foo.py, line 10 in foo<br>1KiB total<br>3 allocations<br>Thread ID: 1"
    );
  });
  test("Generate label with single allocation", () => {
    const data = {
      location: ["foo", "foo.py", "10"],
      n_allocations: 1,
      thread_id: 1,
    };
    expect(makeTooltipString(data, "1KiB", false)).toBe(
      "File foo.py, line 10 in foo<br>1KiB total<br>1 allocation<br>Thread ID: 1"
    );
  });
});

describe("Filter threads", () => {
  const data = {
    thread_id: 0,
    children: [
      {
        thread_id: 1,
        children: [
          {
            thread_id: 1,
            children: [
              {
                thread_id: 1,
                children: [],
              },
            ],
          },
        ],
      },
      {
        thread_id: 2,
        children: [],
      },
    ],
  };

  test("Filter a single thread", () => {
    const result = filterChildThreads(data, 1);
    expect(result).toStrictEqual({
      thread_id: 0,
      children: [
        {
          thread_id: 1,
          children: [
            {
              thread_id: 1,
              children: [
                {
                  thread_id: 1,
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    });
  });
  test("Filter multiple threads", () => {
    const result = filterChildThreads(data, 2);
    expect(result).toStrictEqual({
      thread_id: 0,
      children: [
        {
          thread_id: 2,
          children: [],
        },
      ],
    });
  });
  test("Filter empty children", () => {
    expect(
      filterChildThreads(
        {
          thread_id: 0,
          children: [],
        },
        2
      )
    ).toStrictEqual({
      thread_id: 0,
      children: [],
    });
  });
});

describe("Recalculate allocations in root node", () => {
  const data = {
    thread_id: 0,
    n_allocations: 100,
    value: 100,
    children: [
      {
        thread_id: 1,
        n_allocations: 5,
        value: 50,
        children: [
          {
            thread_id: 1,
            n_allocations: 3,
            value: 30,
            children: [
              {
                thread_id: 1,
                n_allocations: 1,
                value: 10,
                children: [],
              },
            ],
          },
        ],
      },
      {
        thread_id: 1,
        n_allocations: 1,
        value: 10,
        children: [],
      },
    ],
  };
  test("Recalculate allocations", () => {
    const sum = sumAllocations(data.children);
    expect(sum).toStrictEqual({ n_allocations: 6, value: 60 });
  });
});

describe("Filter uninteresting frames", () => {
  const data = {
    interesting: true,
    n_allocations: 10,
    value: 100,
    children: [
      {
        interesting: true,
        n_allocations: 5,
        value: 50,
        children: [
          {
            interesting: false,
            n_allocations: 2,
            value: 20,
            children: [
              {
                interesting: true,
                n_allocations: 1,
                value: 10,
                children: [],
              },
            ],
          },
        ],
      },
      {
        interesting: true,
        n_allocations: 1,
        value: 10,
        children: [],
      },
    ],
  };

  test("Filter uninteresting", () => {
    const result = filterUninteresting(data);
    expect(result).toStrictEqual({
      interesting: true,
      n_allocations: 10,
      value: 100,
      children: [
        {
          interesting: true,
          n_allocations: 5,
          value: 50,
          children: [
            {
              interesting: true,
              n_allocations: 1,
              value: 10,
              children: [],
            },
          ],
        },
        {
          interesting: true,
          n_allocations: 1,
          value: 10,
          children: [],
        },
      ],
    });
  });
  test("Filter uninteresting when first child is not interesting", () => {
    data.children[0].interesting = false;

    const result = filterUninteresting(data);
    expect(result).toStrictEqual({
      interesting: true,
      n_allocations: 10,
      value: 100,
      children: [
        {
          interesting: true,
          n_allocations: 1,
          value: 10,
          children: [],
        },
        {
          interesting: true,
          n_allocations: 1,
          value: 10,
          children: [],
        },
      ],
    });
  });

  test("Filter uninteresting in a deep tree", () => {
    const result = filterUninteresting({
      interesting: true,
      n_allocations: 10,
      value: 100,
      children: [
        {
          interesting: false,
          n_allocations: 5,
          value: 50,
          children: [
            {
              interesting: false,
              n_allocations: 2,
              value: 20,
              children: [
                {
                  interesting: true,
                  n_allocations: 1,
                  value: 10,
                  children: [],
                },
              ],
            },
          ],
        },
        {
          interesting: false,
          n_allocations: 1,
          value: 10,
          children: [],
        },
      ],
    });

    expect(result).toStrictEqual({
      interesting: true,
      n_allocations: 10,
      value: 100,
      children: [
        {
          interesting: true,
          n_allocations: 1,
          value: 10,
          children: [],
        },
      ],
    });
  });
});
