import AddForm from "./AddForm.jsx";
import TodoItem from "./TodoItem.jsx";

// 오른쪽 영역: 선택한 목록의 할 일. 미완료가 위, 완료가 아래(R5).
export default function TodoPanel({ list, todos, onAdd, onToggle, onDelete, onRename }) {
  if (!list) {
    return <main className="panel">목록을 선택해 주세요.</main>;
  }

  const sortedTodos = [...todos.filter((t) => !t.done), ...todos.filter((t) => t.done)];

  return (
    <main className="panel">
      <h1>{list.name}</h1>
      {sortedTodos.length === 0 ? (
        <p className="empty">할 일이 없습니다. 아래에서 추가해 보세요.</p>
      ) : (
        <ul className="todo-list">
          {sortedTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={onToggle}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </ul>
      )}
      <AddForm placeholder="할 일 입력" buttonText="+ 할 일 추가" onAdd={onAdd} />
    </main>
  );
}
