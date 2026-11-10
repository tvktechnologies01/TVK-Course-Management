FROM nginx:alpine
RUN sed -i 's/application\/javascript[[:space:]]*js;/application\/javascript js mjs;/' /etc/nginx/mime.types
COPY dist/recruitment-crm/browser /usr/share/nginx/html
RUN cp /usr/share/nginx/html/index.csr.html /usr/share/nginx/html/index.html 2>/dev/null || true
RUN cp /usr/share/nginx/html/assets/pdfjs/pdf.worker.min.mjs /usr/share/nginx/html/assets/pdfjs/pdf.worker.min.js 2>/dev/null || true
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
