import Lake
open Lake DSL

package simpleMonads {
  -- add package configuration options here
}

lean_lib Monads {
  -- add library configuration options here
}

lean_lib Test {
  -- add library configuration options here
}

@[default_target]
lean_exe simpleMonads {
  root := `Main
}
