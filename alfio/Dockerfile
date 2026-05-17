# Use the official Java 11 environment
FROM eclipse-temurin:11-jre-focal

# 1. Set the working directory
WORKDIR /app

# 2. Install curl to download the file
RUN apt-get update && apt-get install -y curl && apt-get clean

# 3. Download Alf.io directly from GitHub
# We use the M5 milestone which is stable for event management
RUN curl -L -o alfio.jar https://github.com/alfio-event/alf.io/releases/download/2.0-M5/alfio-2.0-M5-boot.jar

# 4. Create the folder where Alf.io stores its configuration
RUN mkdir -p /app/data

# 5. Expose the standard port
EXPOSE 8080

# 6. Start the application
CMD ["java", "-Xmx512m", "-jar", "alfio.jar"]