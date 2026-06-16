# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend-build
WORKDIR /src/frontend/web
COPY src/frontend/web/package*.json ./
RUN npm install
COPY src/frontend/web .
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend-build
WORKDIR /src
COPY Directory.Build.props ./
COPY src ./src
RUN dotnet restore "src/App.Host/App.Host.csproj"
RUN dotnet publish "src/App.Host/App.Host.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
ENV DOTNET_RUNNING_IN_CONTAINER=true
COPY --from=backend-build /app/publish .
COPY --from=frontend-build /src/App.Host/wwwroot ./wwwroot
RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 8080
ENTRYPOINT ["dotnet", "HealthHq.App.Host.dll"]
