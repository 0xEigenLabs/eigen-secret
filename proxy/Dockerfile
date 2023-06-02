FROM nginx
MAINTAINER Eigen
EXPOSE 8443
COPY ./etc /etc/nginx/
RUN ln -sf /dev/stdout /tmp/access.log && ln -sf /dev/stderr /tmp/error.log

