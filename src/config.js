import tinycolor from 'tinycolor2';

export default {
  /**
   * This is our caching backend
   */
  // This used to work, but seems like GitHub no longer allows large website hosting:
  //areaServer: 'https://anvaka.github.io/index-large-cities/data',
  //areaServer: 'http://localhost:8085', // This is un-commented when I develop cache locally
  // So, using S3
  areaServer: 'https://d2uf7yjjctyxf.cloudfront.net/nov-02-2020',

  getDefaultLineColor() {
    return tinycolor('rgba(70, 66, 59, 0.85)');
  },
  getLabelColor() {
    return tinycolor('#46423B');
  },

  getBackgroundColor() {
    return tinycolor('#E7E1D6');
  }
}