import { useState } from "react";

// 할 일 한 줄: 완료 체크(R5), 삭제(R6), 더블클릭으로 이름 수정(R7)
export default function TodoItem({ todo, onToggle, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);

  function startEdit() {
    setDraft(todo.title);
    setEditing(true);
  }

  // Enter 또는 다른 곳 클릭: 저장. 빈 이름이면 저장하지 않고 원래 이름으로 돌아간다.
  function save() {
    const value = draft.trim();
    if (value !== "") onRename(todo.id, value);
    setEditing(false);
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") save();
    if (event.key === "Escape") setEditing(false);
  }

  return (
    <li className={todo.done ? "todo done" : "todo"}>
      <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
      {editing ? (
        <input
          className="edit-input"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
        />
      ) : (
        <span className="title" onDoubleClick={startEdit} title="더블클릭해서 이름 수정">
          {todo.title}
        </span>
      )}
      <button className="delete" onClick={() => onDelete(todo.id)} aria-label="삭제">
        🗑️
      </button>
    </li>
  );
}
