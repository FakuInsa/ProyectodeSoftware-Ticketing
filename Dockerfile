# Etapa de construcción
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copiamos el archivo del proyecto y restauramos dependencias
COPY ["ProyectodeSoftware-Ticketing.csproj", "./"]
RUN dotnet restore "ProyectodeSoftware-Ticketing.csproj"

# Copiamos todo el resto del código
COPY . .

# Compilamos y publicamos el proyecto en modo Release
RUN dotnet publish "ProyectodeSoftware-Ticketing.csproj" -c Release -o /app/publish

# Etapa de ejecución
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app

# Copiamos la aplicación compilada
COPY --from=build /app/publish .

# Exponemos el puerto de la aplicación (por defecto .NET 8/9 usa el 8080)
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# Comando para ejecutar la app
ENTRYPOINT ["dotnet", "ProyectodeSoftware-Ticketing.dll"]
