using Chat.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

// Add Swagger / OpenAPI
builder.Services.AddOpenApi();

// Add SignalR
builder.Services.AddSignalR();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:8080") // frontend origin
              .SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();          // serves wwwroot/index.html by default
app.UseStaticFiles();           // enables static file hosting

app.UseFileServer(new FileServerOptions
{
    RequestPath = "/wwwroot",
    FileProvider = app.Environment.WebRootFileProvider
});

// Use CORS
app.UseCors();

// Map SignalR Hub
app.MapHub<ChatHub>("/chatHub");

app.Run();
