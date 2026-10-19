plugins {
    alias(libs.plugins.lpm.android.library)
    alias(libs.plugins.lpm.android.compose)
}

dependencies {
    api(libs.androidx.compose.material3)
    api(libs.androidx.compose.ui)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.glance.appwidget)
}
