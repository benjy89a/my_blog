import "./globals.css";

export const metadata = {
  title: "수제 디저트 쇼핑몰",
  description: "선물할 수제 디저트를 둘러보세요",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
