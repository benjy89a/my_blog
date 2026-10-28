// 상품 배열을 받아서 카드 목록으로 보여 주는 컴포넌트
export default function ProductList({ products }) {
  if (products.length === 0) {
    return <p className="empty">등록된 상품이 없습니다.</p>;
  }

  return (
    <ul className="product-list">
      {products.map((product) => (
        // id를 각 카드의 고유 식별자(key)로 사용
        <li key={product.id} className={product.soldOut ? "card sold-out" : "card"}>
          <div className="image-area">
            {product.image === "" ? (
              <span>이미지 없음</span>
            ) : (
              <img src={product.image} alt={product.name} />
            )}
          </div>
          <p className="category">{product.category}</p>
          <h2 className="name">{product.name}</h2>
          <p className="price">{product.price.toLocaleString("ko-KR")}원</p>
          {product.soldOut && <span className="badge">품절</span>}
        </li>
      ))}
    </ul>
  );
}
