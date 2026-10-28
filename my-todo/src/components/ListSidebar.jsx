import AddForm from "./AddForm.jsx";

// 왼쪽 영역: 목록 보기(R1), 목록 선택(R2), 새 목록 추가(R3)
export default function ListSidebar({ lists, selectedListId, onSelect, onAdd }) {
  return (
    <aside className="sidebar">
      <h2>📁 목록</h2>
      <ul>
        {lists.map((list) => (
          <li key={list.id}>
            <button
              className={list.id === selectedListId ? "list-button selected" : "list-button"}
              onClick={() => onSelect(list.id)}
            >
              {list.name}
            </button>
          </li>
        ))}
      </ul>
      <AddForm placeholder="새 목록 이름" buttonText="+ 새 목록" onAdd={onAdd} />
    </aside>
  );
}
