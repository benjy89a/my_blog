// 상품 데이터는 data/products.json 한 곳에서만 가져온다.
import products from "../data/products.json";
import ProductList from "./components/ProductList";

export default function Home() {
  return (
    <main className="page">
      <h1>수제 디저트 쇼핑몰</h1>
      <ProductList products={products} />
    </main>
  );
}
