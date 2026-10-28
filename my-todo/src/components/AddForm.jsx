import { useState } from "react";

// 입력 칸 + 추가 버튼. 빈 값(공백만 있는 값 포함)은 추가하지 않는다.
export default function AddForm({ placeholder, buttonText, onAdd }) {
  const [text, setText] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const value = text.trim();
    if (value === "") return;
    onAdd(value);
    setText("");
  }

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <button type="submit">{buttonText}</button>
    </form>
  );
}
