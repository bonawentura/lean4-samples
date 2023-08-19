
def changeFn (c: Char) (acc: String) : String :=
  match c with
  | '-' => "-+" ++ acc
  | '+' => "+-" ++ acc
  | _   => acc

def changer (input : String) : String :=
String.foldr changeFn "" input

#eval changer <| changer "+"


  