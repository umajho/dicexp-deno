# dicexp-deno

> In memory of ADNMB.

使用 deno 编写的骰子表达式执行器。

WIP / DO NOT USE.

## TODO

- [ ] 写文档。
- [ ] 让运算符支持列表与基本类型之间的运算，例如：
  - `10#d6 * 2` == `map(10#d6, &*/2)`
  - `[1, 2, 3] > 2` == `[false, false, true]`？
- [ ] 更精细的执行限制。
  - 作为 MVP，目前只在执行的外层限制了执行时间与结果字符串字数。
  - 其他可以作为限制的方面：
    - 单一列表元素数
    - 值的数量
    - 作用域层数
    - 气（每个执行操作都消耗一定量的气）
  - 另外，需要注意限制比较贵的运算，尤其是如果以后引入了
    bigint，像是指数运算不会止于 `Infinity`。
- [ ] 更好的错误信息。
- [ ] 展开步骤尚未完成（目前的实现只是为了体现步骤的概念。）：
  - 基本上目前所有的错误都会导致层数更深的步骤丢失。
  - 展开的步骤时，部分情况下可以省略掉括号。（比如相同的运算符从左向右执行。）这需要更复杂的记录步骤的实现。
- [ ] 列表的惰性求值。
- [ ] Trampoline。
