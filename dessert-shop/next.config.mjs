/** @type {import('next').NextConfig} */
const nextConfig = {
  // GitHub Pages에 올릴 수 있게 정적 파일(HTML/CSS/JS)로 빌드한다.
  output: "export",
  // Pages 주소(/my_blog/dessert-shop)는 배포할 때만 붙인다. 로컬에서는 localhost:3000 그대로.
  basePath: process.env.NEXT_BASE_PATH || "",
  trailingSlash: true,
};

export default nextConfig;
